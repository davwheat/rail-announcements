with open("l.txt", "r") as f:
    l = f.readlines()

    for i in range(len(l)):
        if len(l[i].strip()) == 7:
            print(l[i].strip()[:3])
